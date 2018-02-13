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

echo json_encode($output);
$conn->close(); 
?>