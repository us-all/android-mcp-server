package com.mcp.testapp;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MCPTestApp";
    private static final int CAMERA_PERMISSION_REQUEST = 100;

    private TextView status;
    private int counter = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        status = findViewById(R.id.status);
        EditText textInput = findViewById(R.id.textInput);
        Button btnTap = findViewById(R.id.btnTap);
        Button btnCounter = findViewById(R.id.btnCounter);
        CheckBox checkbox = findViewById(R.id.checkbox);
        Switch toggle = findViewById(R.id.toggle);
        Button btnPermission = findViewById(R.id.btnPermission);
        Button btnDeepLink = findViewById(R.id.btnDeepLink);
        Button btnBroadcast = findViewById(R.id.btnBroadcast);
        Button btnCrash = findViewById(R.id.btnCrash);

        // Tap button
        btnTap.setOnClickListener(v -> {
            Log.i(TAG, "Button tapped");
            status.setText("Button tapped!");
            Toast.makeText(this, "Tapped!", Toast.LENGTH_SHORT).show();
        });

        // Counter button
        btnCounter.setOnClickListener(v -> {
            counter++;
            btnCounter.setText("Counter: " + counter);
            Log.i(TAG, "Counter: " + counter);
            status.setText("Counter: " + counter);
        });

        // Checkbox
        checkbox.setOnCheckedChangeListener((buttonView, isChecked) -> {
            Log.i(TAG, "Checkbox: " + isChecked);
            status.setText("Checkbox: " + (isChecked ? "checked" : "unchecked"));
        });

        // Toggle
        toggle.setOnCheckedChangeListener((buttonView, isChecked) -> {
            Log.i(TAG, "Toggle: " + isChecked);
            status.setText("Toggle: " + (isChecked ? "ON" : "OFF"));
        });

        // Permission request
        btnPermission.setOnClickListener(v -> {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                    == PackageManager.PERMISSION_GRANTED) {
                status.setText("Camera permission: GRANTED");
                Log.i(TAG, "Camera permission already granted");
            } else {
                ActivityCompat.requestPermissions(this,
                        new String[]{Manifest.permission.CAMERA},
                        CAMERA_PERMISSION_REQUEST);
            }
        });

        // Deep link test
        btnDeepLink.setOnClickListener(v -> {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("mcptest://open?page=test"));
            intent.setPackage(getPackageName());
            startActivity(intent);
        });

        // Broadcast
        btnBroadcast.setOnClickListener(v -> {
            Intent intent = new Intent("com.mcp.testapp.TEST_ACTION");
            intent.putExtra("message", "Hello from MCP Test App");
            sendBroadcast(intent);
            Log.i(TAG, "Broadcast sent: com.mcp.testapp.TEST_ACTION");
            status.setText("Broadcast sent!");
        });

        // Crash button
        btnCrash.setOnClickListener(v -> {
            Log.e(TAG, "Intentional crash triggered!");
            String nullStr = null;
            nullStr.length(); // NPE
        });

        // Text input watcher
        textInput.setOnFocusChangeListener((v, hasFocus) -> {
            if (!hasFocus) {
                String text = textInput.getText().toString();
                Log.i(TAG, "Text input: " + text);
                status.setText("Input: " + text);
            }
        });

        // Handle deep link
        handleDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleDeepLink(intent);
    }

    private void handleDeepLink(Intent intent) {
        Uri data = intent.getData();
        if (data != null) {
            Log.i(TAG, "Deep link received: " + data);
            status.setText("Deep link: " + data);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            status.setText("Camera permission: " + (granted ? "GRANTED" : "DENIED"));
            Log.i(TAG, "Camera permission: " + (granted ? "GRANTED" : "DENIED"));
        }
    }
}
