<?php
header('Content-Type: application/json');
require_once __DIR__ . '/email_helper.php';

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) {
    $data = $_POST;
}

$username = trim($data['username'] ?? '');
$email = trim($data['email'] ?? '');

if (!$username || !$email) {
    echo json_encode(['success' => false, 'message' => 'Username and email are required.']);
    exit;
}

$databaseFile = __DIR__ . '/data.json';
if (!file_exists($databaseFile)) {
    echo json_encode(['success' => false, 'message' => 'Database file not found.']);
    exit;
}

$content = file_get_contents($databaseFile);
$database = json_decode($content, true);
if (!is_array($database) || !isset($database['accounts'][$username])) {
    echo json_encode(['success' => false, 'message' => 'Account not found.']);
    exit;
}

$account = $database['accounts'][$username];
if (!isset($account['email']) || strtolower($account['email']) !== strtolower($email)) {
    echo json_encode(['success' => false, 'message' => 'Email does not match account information.']);
    exit;
}

$otp = random_int(100000, 999999);
$account['otp'] = (string)$otp;
$account['otpExpires'] = time() + 600;
$database['accounts'][$username] = $account;

if (file_put_contents($databaseFile, json_encode($database, JSON_PRETTY_PRINT)) === false) {
    echo json_encode(['success' => false, 'message' => 'Unable to save OTP.']);
    exit;
}

$subject = 'ELSHONA BAGS Password Reset OTP';
$body = "<p>Hello <strong>{$account['name']}</strong>,</p>" .
        "<p>Your password reset code is:</p>" .
        "<h2 style='color:#5d4b2f;'>{$otp}</h2>" .
        "<p>This code expires in 10 minutes.</p>" .
        "<p>If you did not request this, please ignore this message.</p>";

try {
    smtp_send_mail($email, $subject, $body);
    echo json_encode(['success' => true]);
} catch (Exception $ex) {
    echo json_encode(['success' => false, 'message' => 'Email send failed: ' . $ex->getMessage()]);
}
