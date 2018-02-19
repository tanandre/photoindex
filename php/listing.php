<?php
include('util.php');

$output = queryPhotos($_GET['tag']);
	
setCacheHeaders(3600);
header('Content-Type: application/json');
echo json_encode($output);
?>
