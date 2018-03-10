<?php
include('util.php');

$id = $_GET['id'];
$quality = $_GET['q'];

$photo = getPhoto($id);
$file = getPhotoFile($photo, $quality);

if (!file_exists($file)) {
    header('HTTP/1.0 404 Not Found');
    exit;
}

$fp = fopen($file, 'rb');
setCacheHeaders(31536000);
header("Content-Type: image/jpg");
header("Content-Length: " . filesize($file));
header("Content-Disposition: attachment; filename=" . basename($file));
fpassthru($fp);
?>
