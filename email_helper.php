<?php
function load_email_config() {
    $config = require __DIR__ . '/email_config.php';
    return $config;
}

function smtp_get_response($fp) {
    $response = '';
    while ($line = fgets($fp, 515)) {
        $response .= $line;
        if (isset($line[3]) && $line[3] === ' ') {
            break;
        }
    }
    return $response;
}

function smtp_send_command($fp, $command, $expectedCode) {
    fwrite($fp, $command . "\r\n");
    $response = smtp_get_response($fp);
    if (substr($response, 0, 3) !== (string)$expectedCode) {
        throw new Exception("SMTP command failed: {$command} => {$response}");
    }
    return $response;
}

function smtp_send_mail($to, $subject, $body) {
    $config = load_email_config();
    $smtpHost = $config['smtp_host'];
    $smtpPort = $config['smtp_port'];
    $smtpUser = $config['smtp_user'];
    $smtpPass = $config['smtp_pass'];
    $fromEmail = $config['from_email'];
    $fromName = $config['from_name'];

    $context = stream_context_create(['ssl' => ['verify_peer' => false, 'verify_peer_name' => false]]);
    $socket = stream_socket_client("ssl://{$smtpHost}:{$smtpPort}", $errno, $errstr, 30, STREAM_CLIENT_CONNECT, $context);
    if (!$socket) {
        throw new Exception("SMTP connection failed: {$errstr} ({$errno})");
    }

    $greeting = smtp_get_response($socket);
    if (substr($greeting, 0, 3) !== '220') {
        throw new Exception("SMTP greeting failed: {$greeting}");
    }

    smtp_send_command($socket, "EHLO localhost", 250);
    smtp_send_command($socket, "AUTH LOGIN", 334);
    smtp_send_command($socket, base64_encode($smtpUser), 334);
    smtp_send_command($socket, base64_encode($smtpPass), 235);
    smtp_send_command($socket, "MAIL FROM:<{$fromEmail}>", 250);
    smtp_send_command($socket, "RCPT TO:<{$to}>", 250);
    smtp_send_command($socket, "DATA", 354);

    $headers = [];
    $headers[] = "From: {$fromName} <{$fromEmail}>";
    $headers[] = "Reply-To: {$fromEmail}";
    $headers[] = "MIME-Version: 1.0";
    $headers[] = "Content-Type: text/html; charset=UTF-8";
    $headers[] = "Subject: {$subject}";

    $message = implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n.\r\n";
    fwrite($socket, $message);

    $dataResponse = smtp_get_response($socket);
    if (substr($dataResponse, 0, 3) !== '250') {
        throw new Exception("SMTP send failed: {$dataResponse}");
    }

    smtp_send_command($socket, "QUIT", 221);
    fclose($socket);
    return true;
}
