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

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
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
