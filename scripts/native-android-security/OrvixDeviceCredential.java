package __ORVIX_PACKAGE__;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Uses the phone's own secure screen lock. No PIN, pattern, password or
 * biometric template is passed to Orvix JavaScript or its database.
 */
@CapacitorPlugin(name = "OrvixDeviceCredential")
public class OrvixDeviceCredential extends Plugin {
    @PluginMethod
    public void authenticate(PluginCall call) {
        KeyguardManager keyguard =
            (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        if (keyguard == null || !keyguard.isDeviceSecure()) {
            call.reject("PHONE_SCREEN_LOCK_NOT_CONFIGURED");
            return;
        }
        Intent challenge = keyguard.createConfirmDeviceCredentialIntent(
            "Fungua Orvix", "Thibitisha PIN, mchoro au nenosiri la simu yako"
        );
        if (challenge == null) {
            call.reject("DEVICE_CREDENTIAL_UNAVAILABLE");
            return;
        }
        startActivityForResult(call, challenge, "onCredentialResult");
    }

    @ActivityCallback
    private void onCredentialResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject value = new JSObject();
        value.put("verified", result.getResultCode() == Activity.RESULT_OK);
        call.resolve(value);
    }
}
