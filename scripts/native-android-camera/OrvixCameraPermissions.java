package __ORVIX_PACKAGE__;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.Locale;

/**
 * Native Android CAMERA runtime permission for the barcode scanner.
 * Never grants permissions silently. A previously blocked permission can
 * only be re-enabled by the user in Android Application Settings.
 */
@CapacitorPlugin(name = "OrvixCameraPermissions",
    permissions = { @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }) })
public class OrvixCameraPermissions extends Plugin {

    private String permissionStatus() {
        return getPermissionState("camera").name().toLowerCase(Locale.US).replace('_', '-');
    }

    private void respond(PluginCall call) {
        JSObject result = new JSObject();
        result.put("camera", permissionStatus());
        call.resolve(result);
    }

    @PluginMethod
    public void checkCamera(PluginCall call) {
        respond(call);
    }

    @PluginMethod
    public void requestCamera(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED
                || getPermissionState("camera") == PermissionState.DENIED) {
            respond(call);
            return;
        }
        requestPermissionForAlias("camera", call, "cameraPermissionCallback");
    }

    @PermissionCallback
    private void cameraPermissionCallback(PluginCall call) {
        respond(call);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception exception) {
            call.reject("Could not open application settings.");
        }
    }
}
