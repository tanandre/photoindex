<?php
include('util.php');

$id = $_GET['id'];

$photo = getPhoto($id);
$file = getPhotoFile($photo, null);

$extension = strtolower(pathinfo($file)['extension']);

setCacheHeaders(3600);
header('Content-Type: application/json');

if ($extension == 'jpeg' || $extension == 'jpg') {
	$exif = exif_read_data($file, 0, true);
	if ($exif == false) {
		header('HTTP/1.0 500 Internal Server Error - cannot read exif data');
		exit;
	}
	echo json_encode($exif);
} else {
	echo json_encode (new stdClass);
}
?>
