<?php
include('util.php');
	
checkModifiedSince(getLastModifiedTimeListing());

$output = queryPhotos($_GET['tag']);
setCacheHeaders(3600);
header('Content-Type: application/json');
echo json_encode($output, JSON_NUMERIC_CHECK);
?>
