<?php
include('dbconnect.php');

$sql = "SELECT * FROM photo";
$result = $conn->query($sql);

$output = array();
if ($result->num_rows > 0) {
     while($row = $result->fetch_assoc()) {
		 $output[] = $row;
	 }
}

header('Content-Type: application/json');
echo json_encode($output);
$conn->close(); 
?>