<?php
include('util.php');

$id = $_GET['id'];
$quality = $_GET['q'];

$photo = getPhoto($id);

function getFile($photo, $quality) {
	$file = str_replace("/volume1/photo", "/var/services/photo", $photo);
	if (isset($quality)) {
		$pos = strripos($file, "/");
		$thumb = $quality == 1 ? "/SYNOPHOTO_THUMB_M.jpg" : "/SYNOPHOTO_THUMB_XL.jpg";
		$file = substr($file, 0, $pos)."/@eaDir".substr($file, $pos).$thumb;
	}
	return $file;
}

$file = getFile($photo, $quality);

$fp = fopen($file, 'rb');
setCacheHeaders(31536000);
header("Content-Type: image/jpg");
header("Content-Length: " . filesize($file));
fpassthru($fp);
?>
