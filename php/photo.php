<?php
//error_reporting(E_ALL);
include('util.php');

$id = $_GET['id'];
$quality = $_GET['q'];

try {
	$dbh = connectDb();

	$stmt = $dbh->prepare("SELECT path FROM photo WHERE id = ?");

	$stmt->execute(array($id));
	$row = $stmt->fetch();

	$dbh = null;

	$file = str_replace("/volume1/photo", "/var/services/photo", $row["path"]);
	if (isset($quality)) {
		$pos = strripos($file, "/");
		$thumb = $quality == 1 ? "/SYNOPHOTO_THUMB_M.jpg" : "/SYNOPHOTO_THUMB_XL.jpg";
		$file = substr($file, 0, $pos)."/@eaDir".substr($file, $pos).$thumb;
	}
	
	$fp = fopen($file, 'rb');
	setCacheHeaders();
	header("Content-Type: image/jpg");
	header("Content-Length: " . filesize($file));
	fpassthru($fp);
}
catch(PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
