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

//echo $sql;

//try {
	$dbh = new PDO("mysql:host=$servername;dbname=$dbname", $username, $password);

	$stmt = $dbh->prepare($sql);

	$stmt->execute(array($id));
	$row = $stmt->fetch();
	$file = str_replace("/volume1/photo", "/var/services/photo", $row["path"]);
	//header('Content-Type: application/json');
	/*$fp = fopen($file, 'rb');

	header("Content-Type: image/jpg");
	header("Content-Length: " . filesize($file));
	
	echo fpassthru($fp);*/
	//exit;
	//readFile($file);
//echo $id.$file;

/*}
catch(PDOException $e) {
    echo "Error: " . $e->getMessage();
}*/
$conn = null;



	$fp = fopen($file, 'rb');
	header("Content-Type: image/jpg");
	header("Content-Length: " . filesize($file));
	fpassthru($fp);
?>
