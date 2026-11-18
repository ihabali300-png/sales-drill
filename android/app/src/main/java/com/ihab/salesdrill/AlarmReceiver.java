package com.ihab.salesdrill;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class AlarmReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        String type = i.getStringExtra("type");
        if (type == null) return;
        Alarms.notify(c, type);
        // جدولة نفس الميعاد بكرة
        String def = "drill".equals(type) ? Alarms.DEF_DRILL : Alarms.DEF_QUIZ;
        Alarms.schedule(c, type, Alarms.prefs(c).getString(type, def));
    }
}
