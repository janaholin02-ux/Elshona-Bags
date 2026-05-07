<?php
header('Content-Type: application/json');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) {
    $data = $_POST;
}

$username = trim($data['username'] ?? '');
$name = trim($data['name'] ?? '');
$email = trim($data['email'] ?? '');
$password = trim($data['password'] ?? '');

if (!$username || !$name || !$email || !$password) {
    echo json_encode(['success' => false, 'message' => 'All signup fields are required.']);
    exit;
}

$databaseFile = __DIR__ . '/data.json';
$database = [
    'accounts' => [],
    'carts' => [],
    'orders' => []
];

if (file_exists($databaseFile)) {
    $content = file_get_contents($databaseFile);
    $decoded = json_decode($content, true);
    if (is_array($decoded)) {
        $database = array_replace_recursive($database, $decoded);
    }
}

if (!isset($database['accounts']) || !is_array($database['accounts'])) {
    $database['accounts'] = [];
}

if (isset($database['accounts'][$username])) {
    echo json_encode(['success' => false, 'message' => 'Username already exists.']);
    exit;
}

$database['accounts'][$username] = [
    'name' => $name,
    'email' => $email,
    'password' => $password,
    'createdAt' => gmdate('c')
];

if (!isset($database['carts']) || !is_array($database['carts'])) {
    $database['carts'] = [];
}
if (!isset($database['orders']) || !is_array($database['orders'])) {
    $database['orders'] = [];
}

// Give the new user an empty cart in the database so their cart data can be stored later
$database['carts'][$username] = [];

if (file_put_contents($databaseFile, json_encode($database, JSON_PRETTY_PRINT)) === false) {
    echo json_encode(['success' => false, 'message' => 'Unable to save the new account.']);
    exit;
}

echo json_encode(['success' => true]);
