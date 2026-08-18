package dev.vijayaapardhu.handy

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Installing an update is the one thing Dart cannot do on its own —
        // it needs PackageInstaller and the app's own signing certificate.
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, Installer.CHANNEL)
            .setMethodCallHandler { call, result ->
                Installer.handle(applicationContext, call, result)
            }
    }
}
