<?php
include('util.php');

$id = $_GET['id'];
$quality = $_GET['q'];
$video = $_GET['video'];

$photo = getPhoto($id);
$file = getPhotoFile($photo, $quality);

if (!file_exists($file)) {
    header('HTTP/1.0 404 Not Found');
    exit;
}

checkModifiedSince(filemtime($file));
checkETag(md5_file($file));

setCacheHeaders(31536000);
header("Content-Type: ".mime_content_type($file));
header("Content-Length: " . filesize($file));
header("Content-Disposition: attachment; filename=" . basename($file));
$fp = fopen($file, 'rb');
fpassthru($fp);
?>
