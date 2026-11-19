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
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import org.json.JSONObject;
import java.util.ArrayList;
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
    SpeechRecognizer sr;
    boolean listening = false;
    int restarts = 0;

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
        if (rc == 8) {
            if (g.length > 0 && g[0] == PackageManager.PERMISSION_GRANTED) startSpeech();
            else js("window.onSpeechEnd && onSpeechEnd('denied')");
            return;
        }
        if (web != null) web.evaluateJavascript("window.onPermResult && onPermResult()", null);
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("window.onBack ? onBack() : false", v -> {
            if (!"true".equals(v)) MainActivity.super.onBackPressed();
        });
    }

    void js(String code) { runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); }); }

    // ───── التعرف على الصوت ─────
    void startSpeech() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) { js("window.onSpeechEnd && onSpeechEnd('unavailable')"); return; }
        if (sr == null) {
            sr = SpeechRecognizer.createSpeechRecognizer(this);
            sr.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle b) { }
                @Override public void onBeginningOfSpeech() { }
                @Override public void onRmsChanged(float v) { }
                @Override public void onBufferReceived(byte[] b) { }
                @Override public void onEndOfSpeech() { }
                @Override public void onEvent(int t, Bundle b) { }
                @Override public void onPartialResults(Bundle b) { send(b, false); }
                @Override public void onResults(Bundle b) {
                    send(b, true);
                    if (listening) listen();
                }
                @Override public void onError(int e) {
                    boolean soft = e == SpeechRecognizer.ERROR_NO_MATCH || e == SpeechRecognizer.ERROR_SPEECH_TIMEOUT;
                    if (listening && soft && restarts++ < 20) { listen(); return; }
                    listening = false;
                    String code = e == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ? "denied" : (soft ? "silence" : "error");
                    js("window.onSpeechEnd && onSpeechEnd('" + code + "')");
                }
            });
        }
        listening = true; restarts = 0;
        listen();
    }

    void listen() {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-SA");
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L);
        try { sr.startListening(i); } catch (Exception ex) { listening = false; js("window.onSpeechEnd && onSpeechEnd('error')"); }
    }

    void send(Bundle b, boolean fin) {
        ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (r == null || r.isEmpty()) return;
        js("window.onSpeech && onSpeech(" + JSONObject.quote(r.get(0)) + "," + fin + ")");
    }

    void stopSpeech() {
        listening = false;
        if (sr != null) { try { sr.stopListening(); } catch (Exception ignored) { } }
    }

    @Override protected void onPause() { super.onPause(); if (listening) { stopSpeech(); js("window.onSpeechEnd && onSpeechEnd('paused')"); } }
    @Override protected void onDestroy() { if (sr != null) sr.destroy(); super.onDestroy(); }

    class Bridge {
        @JavascriptInterface public void scheduleJson(String json) { Alarms.saveJson(MainActivity.this, json); }
        @JavascriptInterface public void setPlan(String plan) { Alarms.prefs(MainActivity.this).edit().putString("plan", plan).apply(); }
        @JavascriptInterface public void startListen() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 8);
                else startSpeech();
            });
        }
        @JavascriptInterface public void stopListen() { runOnUiThread(MainActivity.this::stopSpeech); }
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
