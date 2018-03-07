<?php
include('util.php');

$tags = $_POST['tags'];
$group = $_POST['group'];

if (!isset($group) || !isset($tags)) {
	echo 'please specify tags and group';
	return;
}

$result = new \stdClass();
$result->rowCount = updateTagsAndGroup($group, $tags);
header('Content-Type: application/json');
echo json_encode($result, JSON_NUMERIC_CHECK);
?>