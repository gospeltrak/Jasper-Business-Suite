package __ORVIX_PACKAGE__;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Bluetooth Classic RFCOMM/SPP thermal printing for paired ESC/POS printers.
 *
 * NO implicit device pairing or BLE claims: customers pair their printer using
 * Android Bluetooth Settings. All socket I/O runs on a serial worker, never
 * on the main thread. It receives formatted receipt text, never a sale mutation.
 */
@CapacitorPlugin(name = "OrvixPrinter",
    permissions = { @Permission(alias = "nearby", strings = { Manifest.permission.BLUETOOTH_CONNECT }) })
public class OrvixPrinter extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final ExecutorService printerIo = Executors.newSingleThreadExecutor();
    private final Object ioLock = new Object();
    private final LinkedHashSet<String> acceptedJobs = new LinkedHashSet<>();
    private BluetoothSocket socket;
    private String currentPrinterId;

    private BluetoothAdapter adapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    private boolean readyToUse(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                && getPermissionState("nearby") != PermissionState.GRANTED) {
            if (getPermissionState("nearby") == PermissionState.DENIED) {
                call.reject("Bluetooth permission blocked. Enable Nearby Devices in Android App Settings.");
            } else {
                requestPermissionForAlias("nearby", call, "onNearbyPermission");
            }
            return false;
        }
        BluetoothAdapter bt = adapter();
        if (bt == null) {
            call.reject("This Android device has no Bluetooth adapter.");
            return false;
        }
        if (!bt.isEnabled()) {
            call.reject("Bluetooth is switched off. Turn it on in Android Settings.");
            return false;
        }
        return true;
    }

    @PermissionCallback
    private void onNearbyPermission(PluginCall call) {
        if (getPermissionState("nearby") != PermissionState.GRANTED) {
            call.reject("Nearby Devices permission was not granted.");
            return;
        }
        dispatch(call);
    }

    private void dispatch(PluginCall call) {
        switch (call.getMethodName()) {
            case "listPrinters": listPrinters(call); break;
            case "connectPrinter": connectPrinter(call); break;
            case "printText": printText(call); break;
            default: call.reject("Unsupported Bluetooth printer operation.");
        }
    }

    @PluginMethod
    public void listPrinters(PluginCall call) {
        if (!readyToUse(call)) return;
        try {
            // Paired devices only; discovery would need BLUETOOTH_SCAN and a
            // receiver lifecycle. Do not silently request location access.
            Set<BluetoothDevice> paired = adapter().getBondedDevices();
            JSArray devices = new JSArray();
            for (BluetoothDevice device : paired) {
                JSObject item = new JSObject();
                item.put("id", device.getAddress());
                String name = device.getName();
                item.put("name", name == null || name.isEmpty() ? device.getAddress() : name);
                devices.put(item);
            }
            JSObject result = new JSObject();
            result.put("devices", devices);
            call.resolve(result);
        } catch (SecurityException error) {
            call.reject("Bluetooth permission unavailable.");
        } catch (Exception error) {
            call.reject("Unable to list paired Bluetooth devices.");
        }
    }

    private BluetoothDevice pairedDevice(String id) {
        Set<BluetoothDevice> paired = adapter().getBondedDevices();
        for (BluetoothDevice device : paired) {
            if (device.getAddress().equals(id)) return device;
        }
        return null;
    }

    private void closeSocketLocked() {
        try { if (socket != null) socket.close(); } catch (Exception ignored) { }
        socket = null;
        currentPrinterId = null;
    }

    private boolean connectLocked(String id) throws Exception {
        if (socket != null && socket.isConnected() && id.equals(currentPrinterId)) return true;
        closeSocketLocked();
        BluetoothDevice device = pairedDevice(id);
        if (device == null) return false;
        // Some inexpensive 58mm printers advertise a paired SPP service but
        // reject an encrypted RFCOMM channel. Prefer secure SPP and retry
        // insecure SPP only after closing the failed socket.
        BluetoothSocket next = device.createRfcommSocketToServiceRecord(SPP_UUID);
        try {
            next.connect();
        } catch (IOException secureError) {
            try { next.close(); } catch (Exception ignored) { }
            next = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
            try {
                next.connect();
            } catch (Exception fallbackError) {
                try { next.close(); } catch (Exception ignored) { }
                throw fallbackError;
            }
        }
        socket = next;
        currentPrinterId = id;
        return true;
    }

    @PluginMethod
    public void connectPrinter(PluginCall call) {
        if (!readyToUse(call)) return;
        final String id = call.getString("id", "");
        if (id.isEmpty()) {
            call.reject("Select a paired Bluetooth printer.");
            return;
        }
        printerIo.execute(() -> {
            try {
                boolean connected;
                synchronized (ioLock) { connected = connectLocked(id); }
                JSObject result = new JSObject();
                result.put("connected", connected);
                call.resolve(result);
            } catch (SecurityException error) {
                call.reject("Nearby Devices permission is required.");
            } catch (Exception error) {
                call.reject("Unable to connect. Make sure the paired printer supports Bluetooth Classic SPP.");
            }
        });
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        synchronized (ioLock) {
            result.put("connected", socket != null && socket.isConnected());
            if (currentPrinterId != null) result.put("printerId", currentPrinterId);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void disconnectPrinter(PluginCall call) {
        printerIo.execute(() -> {
            synchronized (ioLock) { closeSocketLocked(); }
            call.resolve();
        });
    }

    @PluginMethod
    public void printText(PluginCall call) {
        if (!readyToUse(call)) return;
        final String id = call.getString("printerId", "");
        final String jobId = call.getString("jobId", "");
        final String text = call.getString("text", "");
        final int copies = Math.max(1, Math.min(3, call.getInt("copies", 1)));
        final boolean autoReconnect = call.getBoolean("autoReconnect", true);

        if (id.isEmpty() || jobId.isEmpty() || text.isEmpty() || text.length() > 64000) {
            call.reject("Invalid or oversized print job.");
            return;
        }
        printerIo.execute(() -> {
            synchronized (ioLock) {
                try {
                    // Repeating the exact automatic job in the same app session
                    // must not print a second copy accidentally.
                    if (acceptedJobs.contains(jobId)) {
                        JSObject result = new JSObject();
                        result.put("accepted", true);
                        result.put("duplicate", true);
                        result.put("printed", false); // no physical printer confirmation protocol
                        call.resolve(result);
                        return;
                    }
                    if (socket == null || !socket.isConnected() || !id.equals(currentPrinterId)) {
                        if (!autoReconnect || !connectLocked(id)) {
                            call.reject("Printer not connected.");
                            return;
                        }
                    }
                    OutputStream out = socket.getOutputStream();
                    byte[] bytes = text.getBytes(StandardCharsets.US_ASCII);
                    int written = 0;
                    for (int i = 0; i < copies; i++) {
                        out.write(new byte[]{0x1b, 0x40}); // ESC @ initialize
                        out.flush();
                        written += 2;
                        // WC-5808-class portable printer buffers can be small.
                        // Pace 128-byte packets, preserving every CR/LF byte,
                        // so one big Java write does not overrun the receiver.
                        for (int offset = 0; offset < bytes.length; offset += 128) {
                            int length = Math.min(128, bytes.length - offset);
                            out.write(bytes, offset, length);
                            out.flush();
                            written += length;
                            if (offset + length < bytes.length) Thread.sleep(15);
                        }
                        // Give the hardware a moment to feed the last lines
                        // before starting another requested copy.
                        if (i + 1 < copies) Thread.sleep(120);
                    }
                    acceptedJobs.add(jobId);
                    if (acceptedJobs.size() > 100) {
                        Iterator<String> iterator = acceptedJobs.iterator();
                        iterator.next();
                        iterator.remove();
                    }
                    JSObject result = new JSObject();
                    result.put("accepted", true);
                    result.put("printed", false); // SPP write != physical print acknowledgement
                    result.put("bytesWritten", written);
                    result.put("transport", "bluetooth-classic-spp");
                    call.resolve(result);
                } catch (SecurityException error) {
                    call.reject("Bluetooth permission blocked.");
                } catch (Exception error) {
                    closeSocketLocked();
                    call.reject("Bluetooth printer transfer failed. Reconnect the paired printer and retry Test Print.");
                }
            }
        });
    }

    @PluginMethod
    public void openBluetoothSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not open Bluetooth settings.");
        }
    }
}
