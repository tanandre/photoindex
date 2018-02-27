<?php
include('util.php');

$id = $_POST['id'];
$daysOffset = $_POST['daysOffset'];

if (!isset($daysOffset)) {
	echo 'please specify daysOffset';
	return;
}

$result->rowCount = updatePhotosDateOffset($id, $daysOffset);
header('Content-Type: application/json');
echo json_encode($result, JSON_NUMERIC_CHECK);
?>