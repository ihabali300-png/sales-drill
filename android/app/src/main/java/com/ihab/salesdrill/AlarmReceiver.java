package com.ihab.salesdrill;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class AlarmReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        String type = i.getStringExtra("type");
        if (type == null) return;
        Alarms.notify(c, type);
        Alarms.schedule(c, type);   // الميعاد الجاي
    }
}
