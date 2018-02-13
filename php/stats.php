<?php
include('dbconnect.php');

function photoCount($conn)
{
	$result = $conn->query("SELECT count(*) as photoCount FROM photo");
	$output = array();
	if ($result->num_rows > 0) {
		while($row = $result->fetch_assoc()) {
			$output[] = $row;
		}
	}
	//$output = mysql_fetch_object($result);
	return $output;
}

function maxPhotoDate($conn) {
	 $result = $conn->query("SELECT max(date) as maxDate, min(date) as minDate FROM photo");
     $output = array();
	 if ($result->num_rows > 0) {
		 while($row = $result->fetch_assoc()) {
	         $output[] = $row;
	     }
	 }
	return $output;
}


$stats->photoCount = photoCount($conn);
$stats->maxPhotoDate = maxPhotoDate($conn);
echo json_encode($stats);

$conn->close(); 
?>
