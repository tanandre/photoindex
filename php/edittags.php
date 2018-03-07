<?php
include('util.php');

$id = getParameter($_POST['id']);
$tags = getParameter($_POST['tags']);

$result = new \stdClass();
$result->rowCount = updatePhotosTags($id, $tags);
header('Content-Type: application/json');
echo json_encode($result, JSON_NUMERIC_CHECK);
?>