package __ORVIX_PACKAGE__;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.UUID;

/**
 * Send real PDFs to Android sharesheet (WhatsApp, email, etc.).
 *
 * Never sends a WhatsApp text-only URL or claims delivery. Android's chooser
 * must grant the chosen app temporary read access to the PDF content URI.
 * No financial or customer data is persisted to the tenant database.
 */
@CapacitorPlugin(name = "OrvixPdfAttachment")
public class OrvixPdfAttachment extends Plugin {
    private static final int MAX_BASE64_LENGTH = 16 * 1024 * 1024;

    @PluginMethod
    public void sharePdf(PluginCall call) {
        final String fileName = call.getString("fileName", "");
        final String data = call.getString("base64Data", "");
        final String message = call.getString("message", "");

        if (!fileName.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,119}\\.pdf") ||
                fileName.contains("..")) {
            call.reject("Invalid PDF file name.");
            return;
        }
        if (data.isEmpty() || data.length() > MAX_BASE64_LENGTH) {
            call.reject("PDF is empty or too large to share.");
            return;
        }
        final byte[] pdf;
        try {
            pdf = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("Invalid PDF data.");
            return;
        }
        if (pdf.length < 20 || pdf[0] != '%' || pdf[1] != 'P' || pdf[2] != 'D' || pdf[3] != 'F' || pdf[4] != '-') {
            call.reject("File is not a PDF.");
            return;
        }

        try {
            File folder = new File(getContext().getCacheDir(), "orvix-pdf-shares");
            if (!folder.exists() && !folder.mkdirs()) {
                call.reject("Could not prepare PDF sharing folder.");
                return;
            }
            // Unique private directory prevents collisions while preserving
            // the actual receipt/invoice/quotation filename in WhatsApp.
            File shareFolder = new File(folder, UUID.randomUUID().toString());
            if (!shareFolder.mkdirs()) {
                call.reject("Could not prepare PDF attachment.");
                return;
            }
            File file = new File(shareFolder, fileName);
            try (FileOutputStream output = new FileOutputStream(file)) {
                output.write(pdf);
                output.flush();
            }

            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("application/pdf");
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            if (!message.isEmpty()) intent.putExtra(Intent.EXTRA_TEXT, message);
            intent.setClipData(ClipData.newUri(getContext().getContentResolver(), fileName, uri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(intent, "Share PDF using");
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            // Means the chooser opened, NOT WhatsApp delivery was completed.
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to open PDF attachment share.", error);
        }
    }
}
