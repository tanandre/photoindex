<?php
//include('dbconnect.php');
//
$servername = "localhost";
$username = "photoindex";
$password = "dc0b5jjF7bNjarkA";
$dbname = "photoindex4";

$sql = "SELECT p.id, p.date, p.path, p.description FROM photo p ORDER BY date DESC";

$tags = $_GET['tag'];
if (!empty($tags)) {

	function q() {
		return "?";
	}

	$sql = "SELECT p.id, p.date, p.path, p.description FROM photo p"
		." LEFT JOIN photo_tag pt ON pt.photoId = p.id INNER JOIN tag t ON pt.tagId = t.id"
		." WHERE t.name in ("
		.join(",", array_map("q", $tags)) 
		.") ORDER BY date DESC";
}

//echo $sql;

try {
	$dbh = new PDO("mysql:host=$servername;dbname=$dbname", $username, $password);

	$stmt = $dbh->prepare($sql);

	$output = array();
	if ($stmt->execute($tags)) {
/*		while ($row = $stmt->fetch()) {
//			print_r($row["date"] );
			$output[] = $row;
	}*/
		$output = $stmt->fetchAll(PDO::FETCH_ASSOC);
	}
	header('Content-Type: application/json');
	echo json_encode($output);
}
catch(PDOException $e) {
    echo "Error: " . $e->getMessage();
}
$conn = null;

?>
