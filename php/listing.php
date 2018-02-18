<?php
include('util.php');

function createSql($tags) {
	if (empty($tags)) {
	 return "SELECT p.id, p.date, p.path, p.description FROM photo p ORDER BY date DESC";
	}

	function q() {
		return "?";
	}

	return "SELECT p.id, p.date, p.path, p.description FROM photo p"
		." LEFT JOIN photo_tag pt ON pt.photoId = p.id INNER JOIN tag t ON pt.tagId = t.id"
		." WHERE t.name in ("
		.join(",", array_map("q", $tags)) 
		.") ORDER BY date DESC";
}

$tags = $_GET['tag'];
$sql = createSql($tags);

try {
	$dbh = connectDb();
	$stmt = $dbh->prepare($sql);

	$stmt->execute($tags);
	$output = $stmt->fetchAll(PDO::FETCH_ASSOC);
	$dbh = null;
	
	setCacheHeaders(3600);
	header('Content-Type: application/json');
	echo json_encode($output);
}
catch(PDOException $e) {
    echo "Error: " . $e->getMessage();
}

?>
