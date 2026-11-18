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
    static final String DEF_DRILL = "17:30", DEF_QUIZ = "21:00";

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static void save(Context c, String drill, String quiz) {
        prefs(c).edit().putString("drill", drill).putString("quiz", quiz).apply();
        scheduleAll(c);
    }

    static void scheduleAll(Context c) {
        SharedPreferences p = prefs(c);
        schedule(c, "drill", p.getString("drill", DEF_DRILL));
        schedule(c, "quiz", p.getString("quiz", DEF_QUIZ));
    }

    static int code(String type) { return "drill".equals(type) ? 101 : 102; }

    static void schedule(Context c, String type, String hhmm) {
        int h, m;
        try { String[] a = hhmm.split(":"); h = Integer.parseInt(a[0]); m = Integer.parseInt(a[1]); }
        catch (Exception e) { return; }
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, h); cal.set(Calendar.MINUTE, m);
        cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis() + 1000) cal.add(Calendar.DAY_OF_YEAR, 1);

        Intent i = new Intent(c, AlarmReceiver.class).setAction("com.ihab.salesdrill.ALARM_" + type).putExtra("type", type);
        PendingIntent pi = PendingIntent.getBroadcast(c, code(type), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.cancel(pi);
        long t = cal.getTimeInMillis();
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
                ch.setDescription("تمرين البيع والكويز اليومي");
                nm.createNotificationChannel(ch);
            }
        }
    }

    static void notify(Context c, String type) {
        ensureChannel(c);
        boolean drill = "drill".equals(type);
        String title = drill ? "🎯 تمرين البيع النهارده جاهز" : "🧠 كويز النهارده — 3 أسئلة";
        String text = drill ? "عميل مستنيك.. اكتب ردك وشوف التقييم 🔥" : "Brillmann وبروقرسف وقياسات — يلا نشوف 💪";
        Intent open = new Intent(c, MainActivity.class).putExtra("sec", type)
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
