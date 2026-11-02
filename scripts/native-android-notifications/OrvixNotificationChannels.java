package __ORVIX_PACKAGE__;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Native Android notification categories and opt-in permission.
 * This alone does NOT send remote push notifications; FCM and device token
 * registration must be configured separately before push can be enabled.
 */
@CapacitorPlugin(name = "OrvixNotificationChannels",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) })
public class OrvixNotificationChannels extends Plugin {
    @Override
    public void load() {
        super.load();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager =
            (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel important = new NotificationChannel(
            "orvix_important", "Orvix Important Alerts", NotificationManager.IMPORTANCE_HIGH);
        important.setDescription("Business alerts that may appear at the top of the screen.");
        NotificationChannel sales = new NotificationChannel(
            "orvix_sales", "Orvix Sales", NotificationManager.IMPORTANCE_DEFAULT);
        sales.setDescription("Newly recorded sales and payments.");
        NotificationChannel reports = new NotificationChannel(
            "orvix_reports", "Orvix Reports", NotificationManager.IMPORTANCE_DEFAULT);
        reports.setDescription("Daily, weekly and monthly business summaries.");
        manager.createNotificationChannel(important);
        manager.createNotificationChannel(sales);
        manager.createNotificationChannel(reports);
    }

    private void respond(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT < 33) {
            result.put("status", "pre-android-13");
        } else {
            result.put("status", getPermissionState("notifications").name().toLowerCase());
        }
        call.resolve(result);
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        respond(call);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
            respond(call);
        } else {
            requestPermissionForAlias("notifications", call, "permissionResult");
        }
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        respond(call);
    }
}
