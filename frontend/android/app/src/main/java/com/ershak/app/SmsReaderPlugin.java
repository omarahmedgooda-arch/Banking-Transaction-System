package com.ershak.app;

import android.Manifest;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Reads the phone's SMS inbox so Ershak can turn bank messages into expenses.
 * Read-only: it never sends, deletes or changes a message. The app asks before reading, and only
 * messages that look like bank transactions leave the phone, after the customer confirms them.
 */
@CapacitorPlugin(
        name = "SmsReader",
        permissions = { @Permission(alias = "sms", strings = { Manifest.permission.READ_SMS }) }
)
public class SmsReaderPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        JSObject res = new JSObject();
        res.put("granted", getPermissionState("sms") == PermissionState.GRANTED);
        call.resolve(res);
    }

    /** list({ since: epochMillis, limit: 200 }) → { messages: [{ id, address, body, date }] } */
    @PluginMethod
    public void list(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "afterPermission");
            return;
        }
        read(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            read(call);
        } else {
            call.reject("SMS permission denied", "DENIED");
        }
    }

    private void read(PluginCall call) {
        long since = call.getLong("since", 0L);
        int limit = Math.max(1, Math.min(call.getInt("limit", 200), 500));
        Uri inbox = Telephony.Sms.Inbox.CONTENT_URI;
        String[] cols = { Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE };
        JSArray out = new JSArray();
        try (Cursor c = getContext().getContentResolver().query(inbox, cols, Telephony.Sms.DATE + " > ?",
                new String[] { String.valueOf(since) }, Telephony.Sms.DATE + " DESC")) {
            if (c != null) {
                while (c.moveToNext() && out.length() < limit) {
                    JSObject m = new JSObject();
                    m.put("id", c.getLong(0));
                    m.put("address", c.getString(1));
                    m.put("body", c.getString(2));
                    m.put("date", c.getLong(3));
                    out.put(m);
                }
            }
        } catch (SecurityException e) {
            call.reject("SMS permission denied", "DENIED");
            return;
        }
        JSObject res = new JSObject();
        res.put("messages", out);
        call.resolve(res);
    }
}
