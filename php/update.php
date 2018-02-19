<?php
include('util.php');

$id = $_POST['id'];
$date = $_POST['date'];

$rowCount = updatePhoto($id, $date);
echo $rowCount  . " records UPDATED successfully";
?>
