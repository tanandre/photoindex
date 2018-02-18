<?php
include('util.php');

$id = $_GET['id'];

$photo = getPhoto($id);
$file = getPhotoFile($photo);

$exif = exif_read_data($file, 0, true);

setCacheHeaders(3600);
header('Content-Type: application/json');
echo json_encode($exif);

?>
