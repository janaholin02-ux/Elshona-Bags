<?php
header('Content-Type: application/json');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) {
    $data = $_POST;
}

$username = trim($data['username'] ?? '');
$email = trim($data['email'] ?? '');
$otp = trim($data['otp'] ?? '');
$password = trim($data['password'] ?? '');

if (!$username || !$email || !$otp || !$password) {
    echo json_encode(['success' => false, 'message' => 'All fields are required.']);
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
if (empty($account['otp']) || empty($account['otpExpires']) || time() > (int)$account['otpExpires']) {
    echo json_encode(['success' => false, 'message' => 'OTP has expired or is invalid.']);
    exit;
}
if (trim($account['otp']) !== $otp) {
    echo json_encode(['success' => false, 'message' => 'Invalid OTP code.']);
    exit;
}

$account['password'] = $password;
unset($account['otp']);
unset($account['otpExpires']);
$database['accounts'][$username] = $account;
if (file_put_contents($databaseFile, json_encode($database, JSON_PRETTY_PRINT)) === false) {
    echo json_encode(['success' => false, 'message' => 'Unable to update password.']);
    exit;
}

echo json_encode(['success' => true]);
