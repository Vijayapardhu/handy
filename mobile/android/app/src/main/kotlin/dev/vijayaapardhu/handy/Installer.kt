package dev.vijayaapardhu.handy

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.security.MessageDigest

/**
 * Installing a Handy update from inside Handy.
 *
 * Handy is not on the Play Store, so updating used to mean: tap a link, land in
 * a browser, find the file in Downloads, tap it, grant a permission, and only
 * then install. Six steps, four of which happen outside the app, and every one
 * of them a place to give up. Most students simply did not, which is how a fix
 * shipped in one release is still missing from half the phones months later.
 *
 * This does the same job in one: the app downloads the file itself and hands it
 * straight to the system installer.
 *
 * ## What this cannot do
 *
 * It cannot stop Play Protect warning about the install. That warning is
 * Google's, and it is driven by whether Google recognises the signing key and
 * how many installs it has seen — not by anything here. Only distributing
 * through Play makes a key "known". What is removed is everything around it:
 * the browser, the Downloads folder, and re-granting the permission every time.
 *
 * ## Why PackageInstaller and not an ACTION_VIEW intent
 *
 * The intent route needs a FileProvider and reports nothing back — a failed
 * install is indistinguishable from a user who changed their mind. A session
 * reports a real status, so a student who cannot install gets a reason instead
 * of a sheet that quietly does nothing. It also records Handy as the installer
 * of record, which is what keeps later updates from being treated as arriving
 * from nowhere.
 */
object Installer {
    const val CHANNEL = "dev.vijayaapardhu.handy/installer"

    /** Set by the session commit, read back by the receiver. */
    const val ACTION_INSTALL_STATUS = "dev.vijayaapardhu.handy.INSTALL_STATUS"

    fun handle(context: Context, call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            // Where to put the download: app-private cache, so it needs no
            // storage permission and the system reclaims it if space runs short.
            "cacheDir" -> result.success(context.cacheDir.absolutePath)

            // Android will not let an app install anything until the student
            // has allowed it specifically, per-app since Oreo.
            "canInstall" -> result.success(
                Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
                    context.packageManager.canRequestPackageInstalls(),
            )

            "openInstallSettings" -> {
                openInstallSettings(context)
                result.success(null)
            }

            "verify" -> {
                val path = call.argument<String>("path")
                if (path == null) {
                    result.error("no_path", "No file to verify.", null)
                } else {
                    result.success(matchesInstalledSigner(context, path))
                }
            }

            "install" -> {
                val path = call.argument<String>("path")
                if (path == null) {
                    result.error("no_path", "No file to install.", null)
                    return
                }
                try {
                    install(context, File(path))
                    result.success(null)
                } catch (e: Exception) {
                    result.error("install_failed", e.message ?: "Could not start the install.", null)
                }
            }

            else -> result.notImplemented()
        }
    }

    private fun openInstallSettings(context: Context) {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${context.packageName}"),
            )
        } else {
            Intent(Settings.ACTION_SECURITY_SETTINGS)
        }
        // Started from a place that may not be an Activity.
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    /**
     * Whether the downloaded file was signed with the same key as the app
     * already on this phone.
     *
     * This is the security half, and it is not optional. An update is an APK
     * fetched over the network from a URL stored in Firestore, and installing
     * whatever comes back would mean anyone able to change that field — or to
     * sit between the phone and the download — could replace Handy with
     * something that merely looks like it, on a device already signed in to the
     * student's account.
     *
     * Android would ultimately refuse a mismatched signature itself, with
     * "App not installed" and no explanation. Checking here means the refusal
     * happens before anything is installed, and says what actually went wrong.
     */
    private fun matchesInstalledSigner(context: Context, path: String): Boolean {
        val installed = signersOf(context, context.packageName) ?: return false
        val candidate = archiveSigners(context, path) ?: return false
        // Set comparison, not list: the order two signers come back in is not
        // guaranteed, and a key rotation leaves an APK legitimately carrying
        // more than one.
        return candidate.isNotEmpty() && installed.isNotEmpty() && candidate == installed
    }

    private fun signersOf(context: Context, packageName: String): Set<String>? = try {
        @Suppress("DEPRECATION")
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            PackageManager.GET_SIGNATURES
        }
        digests(context.packageManager.getPackageInfo(packageName, flags))
    } catch (_: Exception) {
        null
    }

    private fun archiveSigners(context: Context, path: String): Set<String>? = try {
        @Suppress("DEPRECATION")
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            PackageManager.GET_SIGNATURES
        }
        // Null for a file that is not a readable APK at all — a truncated
        // download, or an error page saved with an .apk name.
        context.packageManager.getPackageArchiveInfo(path, flags)?.let { digests(it) }
    } catch (_: Exception) {
        null
    }

    @Suppress("DEPRECATION")
    private fun digests(info: android.content.pm.PackageInfo): Set<String> {
        val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signing = info.signingInfo ?: return emptySet()
            if (signing.hasMultipleSigners()) {
                signing.apkContentsSigners
            } else {
                signing.signingCertificateHistory
            }
        } else {
            info.signatures
        }
        return signatures.orEmpty().map { signature ->
            MessageDigest.getInstance("SHA-256")
                .digest(signature.toByteArray())
                .joinToString("") { "%02x".format(it) }
        }.toSet()
    }

    private fun install(context: Context, apk: File) {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(
            PackageInstaller.SessionParams.MODE_FULL_INSTALL,
        )
        params.setAppPackageName(context.packageName)

        val sessionId = installer.createSession(params)
        installer.openSession(sessionId).use { session ->
            session.openWrite("handy.apk", 0, apk.length()).use { output ->
                apk.inputStream().use { it.copyTo(output) }
                session.fsync(output)
            }

            val intent = Intent(context, InstallStatusReceiver::class.java)
                .setAction(ACTION_INSTALL_STATUS)
            // MUTABLE because the system fills the result in. The session id is
            // the request code so two commits cannot share one PendingIntent.
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pending = PendingIntent.getBroadcast(context, sessionId, intent, flags)
            session.commit(pending.intentSender)
        }
    }
}

/**
 * Carries the install session's result back.
 *
 * The one status that matters is PENDING_USER_ACTION: the system has a
 * confirmation screen ready and will show it only if somebody starts it. Left
 * unhandled, committing a session appears to do nothing at all — which is
 * precisely how an in-app updater ends up looking broken.
 */
class InstallStatusReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(
            PackageInstaller.EXTRA_STATUS,
            PackageInstaller.STATUS_FAILURE,
        )
        if (status != PackageInstaller.STATUS_PENDING_USER_ACTION) return

        val confirm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(Intent.EXTRA_INTENT) as Intent?
        }
        confirm?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        confirm?.let { context.startActivity(it) }
    }
}
