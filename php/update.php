<?php
include('util.php');

$id = $_POST['id'];
$date = $_POST['date'];

$result = new \stdClass();
$result->rowCount = updatePhotosDate($id, $date);
header('Content-Type: application/json');
echo json_encode($result);
?>