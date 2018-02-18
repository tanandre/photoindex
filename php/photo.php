<?php
include('util.php');

$id = $_GET['id'];
$quality = $_GET['q'];

$photo = getPhoto($id);
$file = getPhotoFile($photo, $quality);

$fp = fopen($file, 'rb');
setCacheHeaders(31536000);
header("Content-Type: image/jpg");
header("Content-Length: " . filesize($file));
fpassthru($fp);
?>
