<?php
include('util.php');
	
checkModifiedSince(getLastModifiedTimeListing());

ob_start("ob_gzhandler");
$output = queryPhotos($_GET['tag'], $_GET['rating']);
setCacheHeaders(3600);
header('Content-Type: application/json');
echo json_encode($output, JSON_NUMERIC_CHECK);
?>
