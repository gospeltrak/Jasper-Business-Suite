package africa.orvix.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Tenant-approved Orvix beta updater. NEVER silently installs an APK.
 * New releases require the SAME private signing key and a higher versionCode.
 * The signed APK is first SHA-256 verified, then Android's package installer
 * independently verifies package name/signature and asks the user to approve.
 *
 * The first beta manifest is inactive until an owner-reviewed signed release
 * is hosted at https://orvix.africa/android-beta-release.json.
 */
public final class OrvixBetaUpdater {
  private static final String MANIFEST_URL = "https://orvix.africa/android-beta-release.json";
  private static final long CHECK_INTERVAL_MS = 6L * 60 * 60 * 1000;
  private static final long MAX_APK_SIZE = 80L * 1024 * 1024;
  private static final long DOWNLOAD_TIMEOUT_MS = 5L * 60 * 1000;
  private static final Handler UI = new Handler(Looper.getMainLooper());
  private static final AtomicBoolean BUSY = new AtomicBoolean(false);
  private static final AtomicBoolean CHECKED_THIS_LAUNCH = new AtomicBoolean(false);
  private static volatile File pendingInstall;

  private OrvixBetaUpdater() {}

  public static void onResume(Activity activity) {
    // Return from Android's install-permission settings: use the already
    // verified file rather than downloading a second APK.
    File ready = pendingInstall;
    if (ready != null && ready.isFile() &&
        (Build.VERSION.SDK_INT < 26 || activity.getPackageManager().canRequestPackageInstalls())) {
      pendingInstall = null;
      UI.post(() -> launchInstaller(activity, ready));
    }
    // A resumed cashier may have unsaved cart/form edits: only check once
    // per cold application launch, never on every focus/phone unlock.
    if (!CHECKED_THIS_LAUNCH.compareAndSet(false, true)) return;
    if (!BUSY.compareAndSet(false, true)) return;
    long now = System.currentTimeMillis();
    android.content.SharedPreferences prefs = activity.getSharedPreferences("orvix_beta_updater", Context.MODE_PRIVATE);
    if (now - prefs.getLong("last_check", 0) < CHECK_INTERVAL_MS) {
      BUSY.set(false);
      return;
    }
    prefs.edit().putLong("last_check", now).apply();
    new Thread(() -> check(activity), "orvix-beta-update-check").start();
  }

  private static long installedVersion(Activity activity) throws Exception {
    android.content.pm.PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
    return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
  }

  private static void check(Activity activity) {
    try {
      HttpURLConnection request = (HttpURLConnection) new URL(MANIFEST_URL).openConnection();
      request.setConnectTimeout(7000);
      request.setReadTimeout(7000);
      request.setRequestProperty("Accept", "application/json");
      request.setInstanceFollowRedirects(false);
      if (request.getResponseCode() != 200) return;
      if (request.getContentLengthLong() > 8192) return;
      byte[] payload;
      try (InputStream stream = request.getInputStream()) {
        payload = readBounded(stream, 8192);
      } finally {
        request.disconnect();
      }
      JSONObject manifest = new JSONObject(new String(payload, java.nio.charset.StandardCharsets.UTF_8));
      if (manifest.optInt("schemaVersion", 0) != 1 ||
          !"africa.orvix.app".equals(manifest.optString("packageName", ""))) return;
      long nextVersion = manifest.optLong("versionCode", 0);
      if (nextVersion <= installedVersion(activity) || nextVersion > Integer.MAX_VALUE) return;
      String url = manifest.optString("apkUrl", "");
      String sha = manifest.optString("sha256", "").toLowerCase(Locale.ROOT);
      if (!sha.matches("[a-f0-9]{64}") || !isApprovedUrl(url)) return;
      String label = manifest.optString("versionName", "mpya");
      UI.post(() -> {
        if (activity.isFinishing() || activity.isDestroyed()) return;
        new AlertDialog.Builder(activity)
          .setTitle("Orvix Update Available")
          .setMessage("Toleo jipya " + label + " linapatikana. Hifadhi mauzo na kazi zako kabla ya kuanza update. Data zako hazitafutwa ikiwa digital signature ni ileile.")
          .setNegativeButton("Baadaye", (dialog, which) -> {})
          .setPositiveButton("Download & Install", (dialog, which) -> download(activity, nextVersion, url, sha))
          .show();
      });
    } catch (Exception ignored) {
      // Internet outages or missing manifest must NEVER interrupt work.
    } finally {
      BUSY.set(false);
    }
  }

  private static boolean isApprovedUrl(String value) {
    try {
      Uri parsed = Uri.parse(value);
      if (!"https".equals(parsed.getScheme()) || parsed.getPort() != -1 ||
          parsed.getUserInfo() != null || parsed.getFragment() != null) return false;
      String host = parsed.getHost();
      return ("orvix.africa".equals(host) || "updates.orvix.africa".equals(host))
        && parsed.getPath() != null && parsed.getPath().endsWith(".apk");
    } catch (Exception ignored) { return false; }
  }

  private static byte[] readBounded(InputStream input, int limit) throws Exception {
    java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
    byte[] block = new byte[4096];
    int count;
    while ((count = input.read(block)) != -1) {
      if (out.size() + count > limit) throw new IllegalStateException("Excessive response size");
      out.write(block, 0, count);
    }
    return out.toByteArray();
  }

  private static void download(Activity activity, long version, String url, String expectedSha) {
    if (!BUSY.compareAndSet(false, true)) return;
    new Thread(() -> {
      try {
        File directory = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (directory == null) return;
        String filename = "Orvix-beta-v" + version + ".apk";
        File destination = new File(directory, filename);
        if (destination.isFile() && matchesHash(destination, expectedSha)) {
          UI.post(() -> launchInstaller(activity, destination));
          return;
        }
        if (destination.exists() && !destination.delete()) return;

        DownloadManager manager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
        DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
        req.setTitle("Orvix Beta " + version);
        req.setDescription("Pakua Orvix update");
        req.setAllowedOverMetered(true);
        req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
        req.setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, filename);
        long id = manager.enqueue(req);
        long started = System.currentTimeMillis();
        while (System.currentTimeMillis() - started < DOWNLOAD_TIMEOUT_MS) {
          Thread.sleep(900);
          DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
          try (android.database.Cursor cursor = manager.query(query)) {
            if (!cursor.moveToFirst()) return;
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            if (status == DownloadManager.STATUS_FAILED) return;
            if (status == DownloadManager.STATUS_SUCCESSFUL) {
              if (!destination.isFile() || destination.length() > MAX_APK_SIZE ||
                  !matchesHash(destination, expectedSha)) {
                destination.delete();
                return;
              }
              UI.post(() -> launchInstaller(activity, destination));
              return;
            }
          }
        }
      } catch (Exception ignored) {
        // Never block the active workspace.
      } finally {
        BUSY.set(false);
      }
    }, "orvix-beta-apk-download").start();
  }

  private static boolean matchesHash(File file, String expected) throws Exception {
    if (!file.isFile() || file.length() < 100_000 || file.length() > MAX_APK_SIZE) return false;
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    try (InputStream stream = new FileInputStream(file)) {
      byte[] chunk = new byte[8192];
      int read;
      while ((read = stream.read(chunk)) != -1) digest.update(chunk, 0, read);
    }
    StringBuilder hex = new StringBuilder();
    for (byte value : digest.digest()) hex.append(String.format(Locale.ROOT, "%02x", value & 0xff));
    return expected.equals(hex.toString());
  }

  private static void launchInstaller(Activity activity, File file) {
    if (activity.isFinishing() || activity.isDestroyed()) return;
    if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
      pendingInstall = file;
      new AlertDialog.Builder(activity)
        .setTitle("Ruhusa ya kusakinisha update")
        .setMessage("Android inahitaji ruhusa ya kusakinisha updates kutoka Orvix. Washa ruhusa kwenye Settings kisha fungua Orvix tena.")
        .setNegativeButton("Cancel", null)
        .setPositiveButton("Open Settings", (dialog, which) -> {
          Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + activity.getPackageName()));
          activity.startActivity(intent);
        }).show();
      return;
    }
    Uri contentUri = FileProvider.getUriForFile(activity,
      activity.getPackageName() + ".updatefiles", file);
    Intent install = new Intent(Intent.ACTION_VIEW);
    install.setDataAndType(contentUri, "application/vnd.android.package-archive");
    install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    activity.startActivity(install);
  }
}
