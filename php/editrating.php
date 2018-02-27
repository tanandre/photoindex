<?php
include('util.php');

$id = $_POST['id'];
$rating = $_POST['rating'];

if (!isset($rating)) {
	echo 'please specify rating';
	return;
}

$result->rowCount = updatePhotosRating($id, $rating);
header('Content-Type: application/json');
echo json_encode($result, JSON_NUMERIC_CHECK);
?>