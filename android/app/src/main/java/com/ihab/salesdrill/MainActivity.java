package com.ihab.salesdrill;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    static final String URL = "https://ihabali300-png.github.io/sales-drill/";
    WebView web;
    boolean askedOnce = false;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.parseColor("#0b130d"));
        getWindow().setNavigationBarColor(Color.parseColor("#0b130d"));
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0b130d"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " SalesDrillApp/1");
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (u.toString().startsWith(URL)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });
        setContentView(web);

        Alarms.ensureChannel(this);
        Alarms.scheduleAll(this);
        askNotifPermission();

        String sec = getIntent() != null ? getIntent().getStringExtra("sec") : null;
        web.loadUrl(sec != null ? URL + "#" + sec : URL);
    }

    @Override protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        String sec = i.getStringExtra("sec");
        if (sec != null && web != null)
            web.evaluateJavascript("window.openSec ? openSec('" + sec + "') : (location.hash='" + sec + "')", null);
    }

    void askNotifPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);
    }

    @Override public void onRequestPermissionsResult(int rc, String[] p, int[] g) {
        super.onRequestPermissionsResult(rc, p, g);
        if (web != null) web.evaluateJavascript("window.onPermResult && onPermResult()", null);
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("window.onBack ? onBack() : false", v -> {
            if (!"true".equals(v)) MainActivity.super.onBackPressed();
        });
    }

    class Bridge {
        @JavascriptInterface public void schedule(String drill, String quiz) { Alarms.save(MainActivity.this, drill, quiz); }
        @JavascriptInterface public void test() { Alarms.notify(MainActivity.this, "drill"); }
        @JavascriptInterface public String notifStatus() {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            boolean ok = Build.VERSION.SDK_INT < 24 || nm.areNotificationsEnabled();
            return ok ? "granted" : "denied";
        }
        @JavascriptInterface public void askPerm() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 && !askedOnce
                        && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    askedOnce = true;
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);
                } else if (Build.VERSION.SDK_INT >= 26) {
                    Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                    startActivity(i);
                } else askNotifPermission();
            });
        }
        @JavascriptInterface public void battery() {
            runOnUiThread(() -> {
                Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
                startActivity(i);
            });
        }
    }
}
