<?php
/**
 * SaleBot API Proxy
 * 
 * Автономный прокси - НЕ загружает WordPress.
 * Ошибки здесь не влияют на основной сайт.
 */

// Запрет прямого доступа через браузер
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Только POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Проверка Origin - только с нашего домена
$allowed_origins = [
    'https://egorsokolov.ru',
    'http://localhost:8080',      // для локальной разработки
    'http://192.168.0.44:8080'    // для тестов с телефона
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!in_array($origin, $allowed_origins)) {
    // Проверяем Referer как fallback (для Telegram WebView)
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    $valid_referer = false;
    foreach ($allowed_origins as $allowed) {
        if (strpos($referer, $allowed) === 0) {
            $valid_referer = true;
            break;
        }
    }
    
    // Telegram WebApp может не слать Origin/Referer, проверяем User-Agent
    $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $is_telegram = (strpos($user_agent, 'Telegram') !== false);
    
    if (!$valid_referer && !$is_telegram) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }
}

// CORS headers
if ($origin && in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ============================================
// API KEY - загружается из config.php (не в git)
// ============================================
$config_file = __DIR__ . '/config.php';
if (!file_exists($config_file)) {
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration missing']);
    exit;
}
$config = include($config_file);
$api_key = $config['api_key'];
$group_id = $config['group_id'];
$salebot_url = "https://chatter.salebot.pro/api/{$api_key}/tg_callback";

// Получаем входные данные
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Валидация
if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

if (!isset($data['user_id']) || !is_numeric($data['user_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid user_id']);
    exit;
}

if (!isset($data['message'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing message']);
    exit;
}

// Добавляем group_id в данные для SaleBot
$data['group_id'] = $group_id;
$payload = json_encode($data);

// Пересылаем в SaleBot
$ch = curl_init($salebot_url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,           // Таймаут 10 сек
    CURLOPT_CONNECTTIMEOUT => 5,     // Таймаут подключения 5 сек
]);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

// Обработка ошибок curl
if ($curl_error) {
    http_response_code(502);
    echo json_encode(['error' => 'Gateway error']);
    // Логируем для отладки (в отдельный файл, не в WordPress)
    error_log("SaleBot API error: $curl_error", 3, __DIR__ . '/api-errors.log');
    exit;
}

// Возвращаем ответ от SaleBot
http_response_code($http_code);
echo $response ?: json_encode(['success' => true]);
