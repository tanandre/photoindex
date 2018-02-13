<?php
include('dbconnect.php');

$sql = "SELECT name FROM tag";
$result = $conn->query($sql);

$output = array();
if ($result->num_rows > 0) {
     while($row = $result->fetch_assoc()) {
		 $output[] = $row;
	 }
}

$stats->tags = $output;

header('Content-Type: application/json');
echo json_encode($stats);
$conn->close(); 
?>