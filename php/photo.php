<?php
error_reporting(E_ALL);

//include('dbconnect.php');
//
$servername = "localhost";
$username = "photoindex";
$password = "dc0b5jjF7bNjarkA";
$dbname = "photoindex4";

$sql = "SELECT path FROM photo WHERE id = 25691";

$id = $_GET['id'];
$quality = $_GET['q'];

try {
	$dbh = new PDO("mysql:host=$servername;dbname=$dbname", $username, $password);

	$stmt = $dbh->prepare($sql);

	$stmt->execute(array($id));
	$row = $stmt->fetch();
	$file = str_replace("/volume1/photo", "/var/services/photo", $row["path"]);
	if (isset($quality)) {
		$pos = strripos($file, "/");
		$file = substr($file, 0, $pos)."/@eaDir".substr($file, $pos)."/SYNOPHOTO_THUMB_M.jpg";
	}
	
	$fp = fopen($file, 'rb');
	header("Content-Type: image/jpg");
	header("Content-Length: " . filesize($file));
	fpassthru($fp);
}
catch(PDOException $e) {
    echo "Error: " . $e->getMessage();
}
$conn = null;
?>
