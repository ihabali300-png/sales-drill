package com.ihab.salesdrill;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** بعد ريستارت الموبايل أو تحديث التطبيق أو تغيير الساعة: نرجّع المواعيد */
public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) { Alarms.scheduleAll(c); }
}
