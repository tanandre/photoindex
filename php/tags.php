<?php
include('util.php');
$id = $_GET['id'];
$tags = isset($id) ? getPhotoTags($id) : getTags();
setCacheHeaders(3600);
header('Content-Type: application/json');
echo json_encode($tags);
?>
