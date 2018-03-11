<?php
include('util.php');

$id = $_GET['id'];

$photo = getPhoto($id);
$file = getPhotoFile($photo);

$extension = strtolower(pathinfo($file)['extension']);

setCacheHeaders(3600);
header('Content-Type: application/json');

if ($extension == 'jpeg' || $extension == 'jpg') {
	$exif = exif_read_data($file, 0, true);
	echo json_encode($exif, JSON_NUMERIC_CHECK);
} else {
	json_encode (new stdClass);
}
?>
