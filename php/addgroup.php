<?php
include('util.php');

$group = $_POST['group'];

if (!isset($group)) {
	echo 'please specify group';
	return;
}

$result = new \stdClass();
$result->rowCount = insertTagGroup($group);
header('Content-Type: application/json');
echo json_encode($result, JSON_NUMERIC_CHECK);
?>