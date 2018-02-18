<?php
function connectDb() {
	$servername = "localhost";
	$username = "photoindex";
	$password = "dc0b5jjF7bNjarkA";
	$dbname = "photoindex4";

	return new PDO("mysql:host=$servername;dbname=$dbname", $username, $password);
}

function setCacheHeaders($duration) {
	$seconds_to_cache = $duration;
	$ts = gmdate("D, d M Y H:i:s", time() + $seconds_to_cache) . " GMT";
	header("Expires: $ts");
	header("Cache-Control: max-age=$seconds_to_cache");
}

function getPhoto($id) {
	$dbh = connectDb();
	$stmt = $dbh->prepare("SELECT path FROM photo WHERE id = ?");
	$stmt->execute(array($id));
	$row = $stmt->fetch();
	$dbh = null;
	return $row["path"];
}

function getPhotoTags($id) {
	$dbh = connectDb();
	$stmt = $dbh->prepare("SELECT tag.name FROM photo_tag INNER JOIN tag on photo_tag.tagId = tag.id WHERE photoId = ?");
	$stmt->execute(array($id));
	$output = $stmt->fetchAll(PDO::FETCH_ASSOC);
	$dbh = null;
	return $output;
}

function getTags() {
	$dbh = connectDb();
	$stmt = $dbh->prepare("SELECT name FROM tag");
	$stmt->execute();
	$output = $stmt->fetchAll(PDO::FETCH_ASSOC);
	$dbh = null;
	return $output;
}
?>
