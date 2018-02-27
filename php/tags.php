<?php
include('util.php');

checkModifiedSince(getLastModifiedTimeTags());

$id = $_GET['id'];
$tags = isset($id) ? getPhotoTags($id) : getTags();
setCacheHeaders(3600);
header('Content-Type: application/json');
echo json_encode($tags, JSON_NUMERIC_CHECK);
?>
