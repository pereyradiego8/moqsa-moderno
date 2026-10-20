plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "ar.com.colectivos.consulta"
    compileSdk = 35
    defaultConfig {
        applicationId = "ar.com.colectivos.consulta"
        minSdk = 26
        targetSdk = 34
        versionCode = 2
        versionName = "0.2.0-beta"
    }
    buildTypes { release { isMinifyEnabled = false } }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
