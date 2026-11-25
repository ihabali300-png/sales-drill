package com.ihab.salesdrill;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import java.util.Calendar;

/** جدولة الإشعارات اليومية بـ AlarmManager — بتشتغل والتطبيق مقفول */
public final class Alarms {
    static final String PREFS = "alarms";
    static final String CH = "daily_training";
    static final String[] TYPES = {"lesson", "drill", "quiz", "warm", "log"};

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static String def(String type) {
        switch (type) {
            case "lesson": return "13:30";
            case "drill": return "17:30";
            case "quiz": return "21:00";
            case "warm": return "18:15";
            case "warm_fri": return "15:15";
            default: return "23:35";
        }
    }

    static int code(String type) {
        switch (type) { case "lesson": return 105; case "drill": return 101; case "quiz": return 102; case "warm": return 103; default: return 104; }
    }

    static String sec(String type) { return "log".equals(type) ? "shift" : "lesson".equals(type) ? "learn" : type; }

    static void save(Context c, String drill, String quiz) {
        prefs(c).edit().putString("drill", drill).putString("quiz", quiz).apply();
        scheduleAll(c);
    }

    static void saveJson(Context c, String json) {
        try {
            org.json.JSONObject o = new org.json.JSONObject(json);
            SharedPreferences.Editor e = prefs(c).edit();
            for (String k : new String[]{"lesson", "drill", "quiz", "warm", "warm_fri", "log"})
                if (o.has(k)) e.putString(k, o.getString(k));
            e.apply();
        } catch (Exception ignored) { }
        scheduleAll(c);
    }

    static void scheduleAll(Context c) { for (String t : TYPES) schedule(c, t); }

    static int[] parse(String hhmm) {
        try { String[] a = hhmm.split(":"); return new int[]{Integer.parseInt(a[0]), Integer.parseInt(a[1])}; }
        catch (Exception e) { return null; }
    }

    /** أقرب ميعاد جاي — الجولة يوم الجمعة ليها ميعاد مختلف */
    static long next(Context c, String type) {
        SharedPreferences p = prefs(c);
        long now = System.currentTimeMillis();
        for (int add = 0; add <= 8; add++) {
            Calendar cal = Calendar.getInstance();
            cal.add(Calendar.DAY_OF_YEAR, add);
            boolean fri = cal.get(Calendar.DAY_OF_WEEK) == Calendar.FRIDAY;
            String key = ("warm".equals(type) && fri) ? "warm_fri" : type;
            int[] hm = parse(p.getString(key, def(key)));
            if (hm == null) return -1;
            cal.set(Calendar.HOUR_OF_DAY, hm[0]); cal.set(Calendar.MINUTE, hm[1]);
            cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0);
            if (cal.getTimeInMillis() > now + 1000) return cal.getTimeInMillis();
        }
        return -1;
    }

    static void schedule(Context c, String type) {
        long t = next(c, type);
        Intent i = new Intent(c, AlarmReceiver.class).setAction("com.ihab.salesdrill.ALARM_" + type).putExtra("type", type);
        PendingIntent pi = PendingIntent.getBroadcast(c, code(type), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.cancel(pi);
        if (t < 0) return;
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        try {
            if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
        } catch (SecurityException se) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
        }
    }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = c.getSystemService(NotificationManager.class);
            if (nm.getNotificationChannel(CH) == null) {
                NotificationChannel ch = new NotificationChannel(CH, "التمرين اليومي", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("تمرين البيع والكويز وجولة السرعة وآخر الشيفت");
                nm.createNotificationChannel(ch);
            }
        }
    }

    static void notify(Context c, String type) {
        ensureChannel(c);
        String title, text;
        switch (type) {
            case "lesson": title = "📚 درس النهارده من المنهج"; text = "خريطة ← قاعدة ← مهمة في المحل ← 3 أسئلة — 10 دقايق بس"; break;
            case "drill": title = "🎯 تمرين البيع النهارده جاهز"; text = "عميل مستنيك.. عندك 5 ثواني تبدأ ترد 🔥"; break;
            case "quiz": title = "🧠 كويز النهارده — 3 أسئلة"; text = "Brillmann وبروقرسف وقياسات — يلا نشوف 💪"; break;
            case "warm":
                title = "⚡ جولة سرعة قبل الشيفت — دقيقتين";
                String plan = prefs(c).getString("plan", "");
                text = plan.isEmpty() ? "10 اعتراضات.. اختار أول خطوة قبل ما الوقت يخلص" : "📌 " + plan;
                break;
            default: title = "🏪 آخر الشيفت — سجّل أرقامك"; text = "عملاء • تقفيلات • إضافات.. وموقف حقيقي حصلك النهارده";
        }
        Intent open = new Intent(c, MainActivity.class).putExtra("sec", sec(type))
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, code(type) + 10, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_notif).setContentTitle(title).setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(pi).setAutoCancel(true).setColor(0xFFA3E635);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        try { nm.notify(code(type), b.build()); } catch (SecurityException ignored) { }
    }

    private Alarms() { }
}
