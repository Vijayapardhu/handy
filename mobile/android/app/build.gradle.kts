import java.util.Properties

// Release signing credentials, kept out of the repo (see .gitignore). The
// keystore itself lives outside the project entirely — this repo is public, and
// a signing key in git history is a signing key anyone can publish an update
// with. CI writes this file from repository secrets before building.
val keystoreProperties = Properties().apply {
    val file = rootProject.file("key.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

plugins {
    id("com.android.application")
    // START: FlutterFire Configuration
    id("com.google.gms.google-services")
    // END: FlutterFire Configuration
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "dev.vijayaapardhu.handy"
    compileSdk = flutter.compileSdkVersion
    // Pinned: several Firebase plugins require this NDK, and letting Flutter
    // pick means a clean checkout can resolve a different one.
    ndkVersion = "27.0.12077973"

    compileOptions {
        // flutter_local_notifications uses java.time under the hood, which
        // needs desugaring to run on older Android versions.
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "dev.vijayaapardhu.handy"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        // Firebase Auth requires 23. Below that is roughly Android 5, which is
        // long out of use among the students this is for.
        minSdk = 23
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            // Only configured when key.properties is present. Referencing a
            // missing keystore here would break `flutter run --release` for
            // anyone who has cloned the repo without the signing material,
            // which is everyone except whoever cuts releases.
            if (keystoreProperties.getProperty("storeFile") != null) {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // A debug-signed release was the previous state, and it is worse
            // than it sounds: the debug key is generated per machine and is
            // well known, so builds from two computers cannot update each
            // other — Android refuses with a signature mismatch and the
            // student sees only "App not installed".
            signingConfig = if (keystoreProperties.getProperty("storeFile") != null) {
                signingConfigs.getByName("release")
            } else {
                logger.warn("No key.properties — signing release with the DEBUG key. Not distributable.")
                signingConfigs.getByName("debug")
            }
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    // Required by flutter_local_notifications (see isCoreLibraryDesugaringEnabled above).
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
